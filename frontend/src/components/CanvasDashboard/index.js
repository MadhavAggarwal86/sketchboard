import { useCallback, useEffect, useRef, useState } from "react";
import { FaPencilAlt } from "react-icons/fa";
import { io } from "socket.io-client";
import { API_URL } from "../../api/client";
import { createCanvas, deleteCanvas, listCanvases, renameCanvas } from "../../api/canvas";
import classes from "./index.module.css";

const CanvasDashboard = ({ token, user, onOpenCanvas, onSignOut, onUnauthorized }) => {
  const [canvases, setCanvases] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingCanvasId, setEditingCanvasId] = useState(null);
  const [canvasNameDraft, setCanvasNameDraft] = useState("");
  const [savingCanvasId, setSavingCanvasId] = useState(null);
  const [sharingCanvasId, setSharingCanvasId] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareNotice, setShareNotice] = useState(null);
  const renameInputRef = useRef(null);
  const socketRef = useRef(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setCanvases(await listCanvases(token));
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("canvasShared", (sharedCanvas) => {
      setCanvases((current) => (
        current.some((canvas) => canvas._id === sharedCanvas._id)
          ? current
          : [sharedCanvas, ...current]
      ));
    });
    socket.on("connect_error", (connectionError) => {
      if (connectionError.message.includes("Authentication")) {
        onUnauthorized();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, onUnauthorized]);

  const newCanvas = async () => {
    setBusy(true);
    setError("");
    try {
      const { canvasId } = await createCanvas(token);
      onOpenCanvas(canvasId);
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      setError(requestError.message);
      setBusy(false);
    }
  };

  const openCanvas = (canvasId) => {
    onOpenCanvas(canvasId);
  };

  const startRenaming = (canvas) => {
    if (savingCanvasId === canvas._id) return;
    if (editingCanvasId === canvas._id) {
      renameInputRef.current?.focus();
      return;
    }
    setError("");
    setCanvasNameDraft("");
    setEditingCanvasId(canvas._id);
  };

  const saveCanvasName = async (canvas) => {
    if (editingCanvasId !== canvas._id || savingCanvasId === canvas._id) return;
    const name = canvasNameDraft.trim();
    if (!name) {
      setEditingCanvasId(null);
      setCanvasNameDraft("");
      return;
    }

    setError("");
    setSavingCanvasId(canvas._id);
    try {
      const result = await renameCanvas(token, canvas._id, name);
      setCanvases((current) => current.map((item) => (
        item._id === canvas._id ? { ...item, name: result.name } : item
      )));
      setCanvasNameDraft("");
      setEditingCanvasId(null);
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      setError(requestError.message);
      setEditingCanvasId(null);
    } finally {
      setSavingCanvasId(null);
    }
  };

  const removeCanvas = async (canvas) => {
    const isOwner = canvas.owner === user?.id;
    const action = isOwner ? "delete this canvas for everyone" : "remove this canvas from your list";
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;
    setError("");
    try {
      await deleteCanvas(token, canvas._id);
      setCanvases((current) => current.filter((item) => item._id !== canvas._id));
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      setError(requestError.message);
    }
  };

  const toggleShare = (canvasId) => {
    setShareError("");
    setShareNotice(null);
    setShareEmail("");
    setSharingCanvasId((current) => current === canvasId ? null : canvasId);
  };

  const shareCanvas = (event, canvasId) => {
    event.preventDefault();
    const email = shareEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setShareError("Enter a valid email address.");
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      setShareError("Sharing is unavailable because the server connection is offline.");
      return;
    }

    setShareError("");
    setShareNotice(null);
    socket.timeout(10000).emit("shareCanvas", { canvasId, email }, (timeoutError, result) => {
      if (timeoutError) {
        setShareError("The sharing request timed out. Check your connection and try again.");
        return;
      }
      if (!result?.ok) {
        setShareError(result?.error || "Unable to share this canvas.");
        return;
      }
      setSharingCanvasId(null);
      setShareEmail("");
      setShareNotice({ canvasId, message: result.message });
    });
  };

  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <div>
          <h1>Your canvases</h1>
          <p>
            Signed in as {
              [user?.first_name, user?.last_name].filter(Boolean).join(" ")
              || user?.name
              || user?.email
            }
          </p>
        </div>
        <div className={classes.actions}>
          <button type="button" onClick={newCanvas} disabled={busy}>New canvas</button>
          <button type="button" className={classes.secondary} onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      {error && <div className={classes.error} role="alert">{error}</div>}
      {busy && <p>Loading…</p>}
      {!busy && !canvases.length && <p className={classes.empty}>No canvases yet. Create one to get started.</p>}
      <section className={classes.grid} aria-label="Saved canvases">
        {canvases.map((canvas) => (
          <article className={classes.card} key={canvas._id}>
            <div>
              <div className={classes.titleRow}>
                {editingCanvasId === canvas._id ? (
                  <input
                    ref={renameInputRef}
                    className={classes.renameInput}
                    aria-label={`Rename ${canvas.name || "canvas"}`}
                    placeholder={canvas.name || "Untitled canvas"}
                    value={canvasNameDraft}
                    onChange={(event) => setCanvasNameDraft(event.target.value)}
                    onBlur={() => saveCanvasName(canvas)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        setEditingCanvasId(null);
                        setCanvasNameDraft("");
                      }
                    }}
                    maxLength={20}
                    autoFocus
                  />
                ) : (
                  <h2>{canvas.name || "Untitled canvas"}</h2>
                )}
                {canvas.owner === user?.id && editingCanvasId !== canvas._id && (
                  <button
                    type="button"
                    className={classes.renameIcon}
                    onClick={() => startRenaming(canvas)}
                    onMouseDown={(event) => {
                      if (editingCanvasId === canvas._id) event.preventDefault();
                    }}
                    title="Rename canvas"
                    aria-label="Rename canvas"
                  >
                    <FaPencilAlt aria-hidden="true" />
                  </button>
                )}
              </div>
              <p>Created {new Date(canvas.createdAt).toLocaleString()}</p>
              <span className={classes.ownerBadge}>
                {canvas.owner === user?.id ? "Owner" : "Shared"}
              </span>
            </div>
            <div className={classes.cardActions}>
              <button
                type="button"
                className={classes.delete}
                onClick={() => removeCanvas(canvas)}
                aria-label={canvas.owner === user?.id ? "Delete canvas" : "Remove shared canvas"}
                disabled={busy}
              >
                {canvas.owner === user?.id ? "Delete" : "Remove"}
              </button>
              {canvas.owner === user?.id && (
                <button
                  type="button"
                  className={classes.secondary}
                  onClick={() => toggleShare(canvas._id)}
                  aria-expanded={sharingCanvasId === canvas._id}
                  aria-label="Share canvas"
                  disabled={busy}
                >
                  Share
                </button>
              )}
              <button type="button" onClick={() => openCanvas(canvas._id)} disabled={busy}>Open</button>
            </div>
            {sharingCanvasId === canvas._id && (
              <form className={classes.shareForm} onSubmit={(event) => shareCanvas(event, canvas._id)}>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  aria-label="Email address to share with"
                  placeholder="Enter user's email"
                  value={shareEmail}
                  onChange={(event) => {
                    setShareEmail(event.target.value);
                    setShareError("");
                  }}
                />
                <button type="submit">Submit</button>
                {shareError && <p className={classes.shareError} role="alert">{shareError}</p>}
              </form>
            )}
            {shareNotice?.canvasId === canvas._id && sharingCanvasId !== canvas._id && (
              <p className={classes.shareNotice} role="status">{shareNotice.message}</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
};

export default CanvasDashboard;
