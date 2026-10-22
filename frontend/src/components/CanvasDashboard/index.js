import { useCallback, useEffect, useState } from "react";
import { createCanvas, deleteCanvas, listCanvases, renameCanvas } from "../../api/canvas";
import classes from "./index.module.css";

const CanvasDashboard = ({ token, user, onOpenCanvas, onSignOut, onUnauthorized }) => {
  const [canvases, setCanvases] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const changeCanvasName = async (canvas) => {
    const name = window.prompt("Canvas name", canvas.name || "Untitled canvas");
    if (name === null || !name.trim()) return;
    setError("");
    try {
      const result = await renameCanvas(token, canvas._id, name.trim());
      setCanvases((current) => current.map((item) => (
        item._id === canvas._id ? { ...item, name: result.name } : item
      )));
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      setError(requestError.message);
    }
  };

  const removeCanvas = async (canvasId) => {
    if (!window.confirm("Delete this canvas? This cannot be undone.")) return;
    setError("");
    try {
      await deleteCanvas(token, canvasId);
      setCanvases((current) => current.filter((canvas) => canvas._id !== canvasId));
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      setError(requestError.message);
    }
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
              <h2>{canvas.name || "Untitled canvas"}</h2>
              <p>Created {new Date(canvas.createdAt).toLocaleString()}</p>
              <small>{canvas._id}</small>
            </div>
            <div className={classes.cardActions}>
              <button type="button" onClick={() => openCanvas(canvas._id)} disabled={busy}>Open</button>
              {canvas.owner === user?.id && (
                <>
                  <button
                    type="button"
                    className={classes.secondary}
                    onClick={() => changeCanvasName(canvas)}
                    aria-label="Rename canvas"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className={classes.delete}
                    onClick={() => removeCanvas(canvas._id)}
                    aria-label="Delete canvas"
                    disabled={busy}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
};

export default CanvasDashboard;
