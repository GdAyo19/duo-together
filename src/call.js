import { buildIceServers, initiatesOffer } from "./domain/call";

function describeMediaError(error) {
  if (error?.name === "NotAllowedError") return "Camera and microphone access was blocked.";
  if (error?.name === "NotFoundError") return "No camera or microphone was found.";
  if (error?.name === "NotReadableError") return "Your camera is already in use by another app.";
  return "Could not start your camera.";
}

export function createCallSession({ supabase, coupleId, userId, rtc, onEvent }) {
  let channel = null;
  let peer = null;
  let localStream = null;
  let remoteUserId = null;
  let started = false;
  let pendingCandidates = [];
  let closed = false;
  let restartAttempts = 0;
  let restartTimer = null;

  const emit = (name, detail = {}) => {
    try {
      onEvent?.(name, detail);
    } catch (error) {
      console.error("Call event handler failed.", error);
    }
  };

  const send = (event, payload) => {
    if (!channel || channel.state !== "joined") return;
    channel.send({ type: "broadcast", event, payload }).catch((error) => {
      console.error(`Could not send call signal "${event}".`, error);
    });
  };

  async function createPeer() {
    peer = new RTCPeerConnection({ iceServers: buildIceServers(rtc) });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        send("ice-candidate", { from: userId, candidate: event.candidate.toJSON() });
      }
    };

    peer.ontrack = (event) => {
      emit("remote-stream", { stream: event.streams[0] });
    };

    peer.onconnectionstatechange = () => {
      if (!peer) return;
      if (peer.connectionState === "connected") {
        restartAttempts = 0;
        emit("connected");
        return;
      }
      if (peer.connectionState === "failed") {
        restartConnection();
        return;
      }
      if (peer.connectionState === "disconnected") {
        restartConnection();
        return;
      }
      if (peer.connectionState === "closed") emit("disconnected");
    };

    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    return peer;
  }

  async function makeOffer() {
    await createPeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    send("offer", { from: userId, description: peer.localDescription });
    emit("calling");
  }

  async function handleSignal(event, payload) {
    if (closed || !payload || payload.from === userId) return;
    remoteUserId = payload.from;

    if (event === "hello") {
      if (initiatesOffer(userId, payload.from)) {
        if (!peer) {
          emit("calling");
          await makeOffer();
        }
        return;
      }
      if (payload.reply !== true) send("hello", { from: userId, reply: true });
      return;
    }

    if (event === "offer") {
      if (!localStream) {
        emit("failed", { reason: "The call started before your camera was ready." });
        return;
      }
      if (!peer) await createPeer();
      if (peer.signalingState !== "stable") return;
      await peer.setRemoteDescription(payload.description);
      await flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      send("answer", { from: userId, description: peer.localDescription });
      emit("connecting");
      return;
    }

    if (event === "answer") {
      if (!peer || peer.signalingState === "stable") return;
      await peer.setRemoteDescription(payload.description);
      await flushCandidates();
      emit("connecting");
      return;
    }

    if (event === "ice-candidate") {
      if (!peer || !peer.remoteDescription) {
        pendingCandidates.push(payload.candidate);
        return;
      }
      await peer.addIceCandidate(payload.candidate).catch((error) => {
        console.error("Could not add a call candidate.", error);
      });
      return;
    }

    if (event === "bye") {
      emit("partner-left");
    }
  }

  function restartConnection() {
    if (closed || !peer || !localStream) return;
    if (restartAttempts >= 2) {
      emit("failed", { reason: "The call dropped. You can keep learning." });
      return;
    }
    if (!remoteUserId || !initiatesOffer(userId, remoteUserId)) {
      emit("disconnected");
      return;
    }
    if (restartTimer) clearTimeout(restartTimer);
    emit("reconnecting");
    restartTimer = setTimeout(async () => {
      restartTimer = null;
      if (closed || !peer) return;
      restartAttempts += 1;
      try {
        const offer = await peer.createOffer({ iceRestart: true });
        await peer.setLocalDescription(offer);
        send("offer", { from: userId, description: peer.localDescription });
      } catch (error) {
        console.error("Could not restart the call.", error);
        emit("failed", { reason: "Could not reconnect the call." });
      }
    }, 1500);
  }

  async function flushCandidates() {
    const queued = pendingCandidates;
    pendingCandidates = [];
    for (const candidate of queued) {
      await peer.addIceCandidate(candidate).catch(() => {});
    }
  }

  async function start() {
    if (started || closed) return;
    started = true;

    if (!navigator.mediaDevices?.getUserMedia) {
      emit("failed", { reason: "This browser cannot make video calls." });
      return;
    }

    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (error) {
      console.error("Could not start the camera.", error);
      emit("failed", { reason: describeMediaError(error) });
      return;
    }
    emit("local-stream", { stream: localStream });

    const onSignal = (event) => ({ payload }) => {
      handleSignal(event, payload).catch((error) => {
        console.error(`Could not handle the call signal "${event}".`, error);
        emit("failed", { reason: "Could not connect the call." });
      });
    };

    channel = supabase
      .channel(`call:${coupleId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "hello" }, onSignal("hello"))
      .on("broadcast", { event: "offer" }, onSignal("offer"))
      .on("broadcast", { event: "answer" }, onSignal("answer"))
      .on("broadcast", { event: "ice-candidate" }, onSignal("ice-candidate"))
      .on("broadcast", { event: "bye" }, onSignal("bye"));

    channel.subscribe((status) => {
      if (closed) return;
      if (status === "SUBSCRIBED") {
        emit("ready");
        send("hello", { from: userId });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        emit("failed", { reason: "Could not reach the call service." });
      }
    });
  }

  function setMuted(muted) {
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    return muted;
  }

  function setVideoOff(off) {
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !off;
    });
    return off;
  }

  function hangUp({ notifyPartner = true } = {}) {
    if (closed) return;
    if (notifyPartner && remoteUserId) send("bye", { from: userId });
    closed = true;

    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = null;
    pendingCandidates = [];
    localStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
    if (peer) {
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
      peer = null;
    }
    if (channel && supabase) {
      supabase.removeChannel(channel);
      channel = null;
    }
    emit("ended");
  }

  return {
    start,
    hangUp,
    setMuted,
    setVideoOff,
    isCalling: () => Boolean(localStream)
  };
}
