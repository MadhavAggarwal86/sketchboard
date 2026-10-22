import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { FaPencilAlt } from "react-icons/fa";
import Auth from "./components/Auth";
import Board from "./components/Board";
import CanvasDashboard from "./components/CanvasDashboard";
import Toolbar from "./components/Toolbar";
import Toolbox from "./components/Toolbox";
import BoardProvider from "./store/BoardProvider";
import ToolBoxProvider from "./store/toolboxProvider";
import { loadCanvas, renameCanvas, saveCanvas } from "./api/canvas";
import { hydrateElements, serializeElements } from "./utils/element";
import classes from "./App.module.css";

const readSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem("whiteboard-session"));
    return session?.token ? session : null;
  } catch (error) {
    localStorage.removeItem("whiteboard-session");
    return null;
  }
};

const ActiveCanvas = ({ token, canvas, canRename, onBack, onSignOut }) => {
  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [canvasName, setCanvasName] = useState(canvas.name || "Untitled canvas");
  const [nameDraft, setNameDraft] = useState(canvas.name || "Untitled canvas");
  const initialElements = useMemo(
    () => hydrateElements(canvas.elements || []),
    [canvas.elements]
  );

  useEffect(() => {
    const name = canvas.name || "Untitled canvas";
    setCanvasName(name);
    setNameDraft(name);
  }, [canvas._id, canvas.name]);

  const saveElements = useCallback(async (elements) => {
    setSaveStatus("Saving…");
    try {
      await saveCanvas(token, canvas._id, serializeElements(elements));
      setSaveStatus("All changes saved");
    } catch (error) {
      if (error.status === 401) {
        onSignOut();
        return;
      }
      setSaveStatus(`Save failed: ${error.message}`);
    }
  }, [token, canvas._id, onSignOut]);

  const submitCanvasName = async (event) => {
    event.preventDefault();
    if (!nameDraft.trim() || nameDraft.trim() === canvasName) return;
    setSaveStatus("Renaming…");
    try {
      const result = await renameCanvas(token, canvas._id, nameDraft.trim());
      setCanvasName(result.name);
      setNameDraft(result.name);
      setSaveStatus("Canvas name saved");
    } catch (error) {
      if (error.status === 401) {
        onSignOut();
        return;
      }
      setSaveStatus(`Rename failed: ${error.message}`);
    }
  };

  return (
    <BoardProvider
      key={canvas._id}
      initialElements={initialElements}
      onElementsChange={saveElements}
    >
      <ToolBoxProvider>
        <div className={classes.canvasHeader}>
          <div className={classes.canvasHeaderLeft}>
            <button className={classes.canvasBackButton} type="button" onClick={onBack}>
              ← Canvases
            </button>
            {canRename ? (
              <form className={classes.nameForm} onSubmit={submitCanvasName}>
                <input
                  aria-label="Canvas name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  maxLength={20}
                  required
                />
                <button
                  className={classes.renameButton}
                  type="submit"
                  title="Rename canvas"
                  aria-label="Rename canvas"
                  disabled={!nameDraft.trim() || nameDraft.trim() === canvasName}
                >
                  <FaPencilAlt aria-hidden="true" />
                </button>
              </form>
            ) : (
              <strong>{canvasName}</strong>
            )}
          </div>
          <Toolbar />
          <span className={classes.saveStatus} role="status">{saveStatus}</span>
        </div>
        <Board />
        <Toolbox />
      </ToolBoxProvider>
    </BoardProvider>
  );
};

const CanvasRoute = ({ token, user, onSignOut }) => {
  const { canvasId } = useParams();
  const navigate = useNavigate();
  const [canvas, setCanvas] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    setCanvas(null);
    setError("");
    setLoading(true);
    loadCanvas(token, canvasId)
      .then((loadedCanvas) => {
        if (isCurrent) setCanvas(loadedCanvas);
      })
      .catch((requestError) => {
        if (!isCurrent) return;
        if (requestError.status === 401) onSignOut();
        setError(requestError.message);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, canvasId, onSignOut]);

  if (loading) return <main className={classes.routeMessage}>Loading canvas…</main>;
  if (error) {
    return (
      <main className={classes.routeMessage}>
        <p role="alert">{error}</p>
        <button type="button" onClick={() => navigate("/")}>Back to canvases</button>
      </main>
    );
  }
  if (!canvas) return <main className={classes.routeMessage}>Canvas not found.</main>;

  return (
    <ActiveCanvas
      key={canvas._id}
      token={token}
      canvas={canvas}
      canRename={canvas.owner === user?.id}
      onBack={() => navigate("/")}
      onSignOut={onSignOut}
    />
  );
};

function App() {
  const [session, setSession] = useState(readSession);
  const navigate = useNavigate();

  const signOut = useCallback(() => {
    localStorage.removeItem("whiteboard-session");
    setSession(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const acceptSession = (result) => {
    const nextSession = { token: result.token, user: result.user };
    localStorage.setItem("whiteboard-session", JSON.stringify(nextSession));
    setSession(nextSession);
    navigate("/", { replace: true });
  };

  if (!session) return <Auth onAuthenticated={acceptSession} />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <CanvasDashboard
            token={session.token}
            user={session.user}
            onOpenCanvas={(canvasId) => navigate(`/canvas/${encodeURIComponent(canvasId)}`)}
            onSignOut={signOut}
            onUnauthorized={signOut}
          />
        }
      />
      <Route
        path="/canvas/:canvasId"
        element={<CanvasRoute token={session.token} user={session.user} onSignOut={signOut} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
