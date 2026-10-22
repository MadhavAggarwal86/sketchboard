import {useRef, useState, useEffect, useLayoutEffect, useContext} from "react";
import rough from "roughjs";
import boardContext from "../../store/board-context";
import { TOOL_ACTION_TYPES, TOOL_ITEMS } from "../../constants";
import toolBoxContext from "../../store/toolbox-context";
import { getTextLayout } from "../../utils/element";
import { FaComment } from "react-icons/fa";
import classes from "./index.module.css";

function Board({
  commentMode = false,
  comments = [],
  onAddComment,
  commentConnectionError = "",
}) {
  const canvasref = useRef();
  const {
    elements,
    editingTextId,
    activeToolItem,
    BoardMouseDownhandler,
    BoardMouseMovehandler,
    BoardMouseUpHandler,
    textAreaBlurHandler,
    cancelTextHandler,
    toolActionType,
  } = useContext(boardContext);
  const { toolboxState } = useContext(toolBoxContext);
  const [text, setText] = useState("");
  const textAreaRef = useRef(null);
  const cancelledTextId = useRef(null);
  const commentInputRef = useRef(null);
  const [commentDraft, setCommentDraft] = useState(null);
  const [selectedCommentId, setSelectedCommentId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitError, setCommentSubmitError] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const writingElement = toolActionType === TOOL_ACTION_TYPES.WRITING
    ? elements.find((element) => element.id === editingTextId)
    : null;
  const writingElementId = writingElement?.id;
  const writingSize = toolboxState[TOOL_ITEMS.TEXT]?.size ?? writingElement?.size ?? 16;
  const writingLayout = writingElement
    ? getTextLayout(
        text,
        writingSize,
        writingElement.layout?.maxWidth || Math.max(1, window.innerWidth - writingElement.x1 - 4)
      )
    : null;

  useEffect(() => {
    if (writingElementId !== undefined) {
      setText(writingElement.text || "");
      textAreaRef.current?.focus();
    }
  }, [writingElementId, toolActionType, writingElement?.text]);

  useEffect(() => {
    if (commentDraft) commentInputRef.current?.focus();
  }, [commentDraft]);

  useLayoutEffect(() => {
    const canvas = canvasref.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasref.current;
    const context = canvas.getContext("2d");
    const roughCanvas = rough.canvas(canvas); 

    elements.forEach((element) => {
      context.save();
      switch (element.type) {
        case TOOL_ITEMS.LINE:
        case TOOL_ITEMS.RECTANGLE:
        case TOOL_ITEMS.CIRCLE:
        case TOOL_ITEMS.ARROW:
          roughCanvas.draw(element.roughEle);
          break;
        case TOOL_ITEMS.BRUSH:
          context.fillStyle = element.stroke;
          context.fill(element.path);
          break;
        case TOOL_ITEMS.TEXT:
          context.textBaseline = "top";
          context.font = `${element.size || 16}px Caveat, cursive`;
          context.fillStyle = element.stroke;
          (element.layout?.lines || element.text.split("\n")).forEach((line, index) => {
            context.fillText(
              line,
              element.x1,
              element.y1 + index * (element.layout?.lineHeight || (element.size || 16) * 1.2)
            );
          });
          break;
        default:
          throw new Error("Type not recognized");
      }
      context.restore();
    });

    return () => {
      context.clearRect(0,0, canvas.width, canvas.height);
    };
  }, [elements]);

  const handleMouseDown = (event) => {
    if (commentMode) return;
    if (writingElement) {
      textAreaBlurHandler(
        writingElementId,
        text,
        writingLayout,
        writingSize
      );
      return;
    }
    BoardMouseDownhandler(
      event,
      toolboxState,
      Math.max(1, window.innerWidth - event.clientX - 4)
    );
  }
  const handleCanvasClick = (event) => {
    if (writingElement) {
      textAreaBlurHandler(
        writingElementId,
        text,
        writingLayout,
        writingSize
      );
      return;
    }
    if (commentMode) {
      setSelectedCommentId(null);
      setCommentSubmitError("");
      setCommentText("");
      setCommentDraft({ x: event.clientX, y: event.clientY });
      return;
    }
    if (
      activeToolItem !== TOOL_ITEMS.TEXT
      || toolActionType !== TOOL_ACTION_TYPES.NONE
    ) {
      return;
    }
    BoardMouseDownhandler(
      event,
      toolboxState,
      Math.max(1, window.innerWidth - event.clientX - 4)
    );
    BoardMouseUpHandler();
  };
  const handleMouseMove = (event) => {
    if (
      toolActionType === TOOL_ACTION_TYPES.DRAWING
      || toolActionType === TOOL_ACTION_TYPES.ERASING
      || toolActionType === TOOL_ACTION_TYPES.MOVING_TEXT
    ) {
      BoardMouseMovehandler(event);
    }
  }

  const handleTextChange = (event) => {
    setText(event.target.value);
  };

  const handleTextBlur = (event) => {
    if (cancelledTextId.current === writingElementId) {
      cancelledTextId.current = null;
      return;
    }
    if (event.relatedTarget?.closest?.("[data-text-size-control], [data-text-color-control]")) return;
    textAreaBlurHandler(
      writingElementId,
      text,
      writingLayout,
      writingSize
    );
  };

  const handleTextKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelledTextId.current = writingElementId;
      cancelTextHandler(writingElementId);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!commentDraft || !commentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    setCommentSubmitError("");
    try {
      await onAddComment({
        x: commentDraft.x,
        y: commentDraft.y,
        text: commentText.trim(),
      });
      setCommentDraft(null);
      setCommentText("");
    } catch (error) {
      setCommentSubmitError(error.message);
    } finally {
      setSubmittingComment(false);
    }
  };


  return (
    <>
      <canvas
        ref={canvasref}
        id="whiteboard-canvas"
        className={commentMode ? classes.commentCanvas : undefined}
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={BoardMouseUpHandler}
        onPointerCancel={BoardMouseUpHandler}
        onClick={handleCanvasClick}
      />
      {commentConnectionError && (
        <div className={classes.commentConnectionError} role="status">
          {commentConnectionError}
        </div>
      )}
      {comments.map((comment, index) => (
        <div
          key={comment._id}
          className={classes.commentMarker}
          style={{ left: comment.x, top: comment.y }}
        >
          <button
            type="button"
            className={classes.commentPin}
            aria-label={`View comment ${index + 1} by ${comment.author?.name || "user"}`}
            aria-expanded={selectedCommentId === comment._id}
            onClick={() => setSelectedCommentId((current) => (
              current === comment._id ? null : comment._id
            ))}
          >
            <FaComment />
          </button>
          {selectedCommentId === comment._id && (
            <div className={classes.commentBubble}>
              <strong>{comment.author?.name || "User"}</strong>
              <p>{comment.text}</p>
            </div>
          )}
        </div>
      ))}
      {commentDraft && (
        <form
          className={classes.commentEditor}
          style={{ left: commentDraft.x, top: commentDraft.y }}
          onSubmit={submitComment}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <textarea
            ref={commentInputRef}
            aria-label="Write a canvas comment"
            placeholder="Write a comment…"
            value={commentText}
            maxLength={2000}
            onChange={(event) => setCommentText(event.target.value)}
          />
          {commentSubmitError && <p role="alert">{commentSubmitError}</p>}
          <div>
            <button type="button" onClick={() => setCommentDraft(null)}>Cancel</button>
            <button type="submit" disabled={!commentText.trim() || submittingComment}>
              {submittingComment ? "Sending…" : "Comment"}
            </button>
          </div>
        </form>
      )}
      {writingElement && (
        <textarea
          ref={textAreaRef}
          aria-label="Enter text"
          autoFocus
          value={text}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: writingElement.x1,
            top: writingElement.y1,
            width: writingLayout.maxWidth,
            minHeight: writingLayout.lineHeight,
            height: Math.max(writingLayout.lineHeight, writingLayout.height),
            boxSizing: "border-box",
            padding: 0,
            border: "none",
            outline: "none",
            resize: "none",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-all",
            lineHeight: `${writingLayout.lineHeight}px`,
            font: `${writingSize}px Caveat, cursive`,
            color: writingElement.stroke || "#000000",
            background: "transparent",
          }}
        />
      )}
    </>
  );
}

export default Board;
