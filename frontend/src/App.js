import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { FaPencilAlt } from "react-icons/fa";
import { io } from "socket.io-client";
import Auth from "./components/Auth";
import Board from "./components/Board";
import CanvasDashboard from "./components/CanvasDashboard";
import Toolbar from "./components/Toolbar";
import Toolbox from "./components/Toolbox";
import BoardProvider from "./store/BoardProvider";
import ToolBoxProvider from "./store/toolboxProvider";
import { loadCanvas, renameCanvas, saveCanvas } from "./api/canvas";
import { API_URL } from "./api/client";
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

const ActiveCanvas = ({
  token,
  canvas,
  canRename,
  onBack,
  onSignOut,
  onCanvasUnavailable,
}) => {
  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [comments, setComments] = useState([]);
  const [commentMode, setCommentMode] = useState(false);
  const [commentConnectionError, setCommentConnectionError] = useState("");
  const commentSocketRef = useRef(null);
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

  useEffect(() => {
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    commentSocketRef.current = socket;

    socket.on("connect", () => {
      socket.timeout(10000).emit("joinCanvas", { canvasId: canvas._id }, (timeoutError, result) => {
        if (timeoutError) {
          setCommentConnectionError("Could not load comments. Check your connection and retry.");
          return;
        }
        if (!result?.ok) {
          setCommentConnectionError(result?.error || "Could not load comments.");
          return;
        }
        setCommentConnectionError("");
        setComments((current) => {
          const liveComments = new Map(current.map((comment) => [comment._id, comment]));
          result.comments.forEach((comment) => liveComments.set(comment._id, comment));
          return [...liveComments.values()].sort(
            (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
          );
        });
      });
    });
    socket.on("newComment", (comment) => {
      if (comment.canvasId !== canvas._id.toString()) return;
      setComments((current) => (
        current.some((item) => item._id === comment._id)
          ? current
          : [...current, comment]
      ));
    });
    const handleCanvasUnavailable = () => {
      setComments([]);
      socket.disconnect();
      onCanvasUnavailable();
    };
    socket.on("canvasDeleted", handleCanvasUnavailable);
    socket.on("canvasAccessRevoked", (event) => {
      if (event.canvasId === canvas._id.toString()) handleCanvasUnavailable();
    });
    socket.on("connect_error", (error) => {
      setCommentConnectionError(
        error.message.includes("Authentication")
          ? "Your session expired. Please sign in again."
          : "Live comments are temporarily disconnected."
      );
    });

    return () => {
      socket.disconnect();
      commentSocketRef.current = null;
    };
  }, [token, canvas._id, onCanvasUnavailable]);

  const addComment = useCallback((comment) => new Promise((resolve, reject) => {
    const socket = commentSocketRef.current;
    if (!socket?.connected) {
      reject(new Error("Live comments are disconnected. Please try again."));
      return;
    }

    socket.timeout(10000).emit(
      "newComment",
      { canvasId: canvas._id, ...comment },
      (timeoutError, result) => {
        if (timeoutError) {
          reject(new Error("The comment request timed out. Please try again."));
        } else if (!result?.ok) {
          reject(new Error(result?.error || "Unable to add comment."));
        } else {
          resolve(result.comment);
        }
      }
    );
  }), [canvas._id]);

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
          <Toolbar
            commentMode={commentMode}
            onToggleCommentMode={() => setCommentMode((current) => !current)}
          />
          <span className={classes.saveStatus} role="status">{saveStatus}</span>
        </div>
        <Board
          commentMode={commentMode}
          comments={comments}
          onAddComment={addComment}
          commentConnectionError={commentConnectionError}
        />
        <Toolbox />
      </ToolBoxProvider>
    </BoardProvider>
  );
};

const CanvasRoute = ({ token, user, onSignOut }) => {
  const { canvasId } = useParams();
  const navigate = useNavigate();
  const handleCanvasUnavailable = useCallback(
    () => navigate("/", { replace: true }),
    [navigate]
  );
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
      onCanvasUnavailable={handleCanvasUnavailable}
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
