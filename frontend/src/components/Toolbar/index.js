import { useContext } from "react";
import classes from "./index.module.css";
import cx from "classnames";
import { LuRectangleHorizontal } from "react-icons/lu";
import { FaSlash, FaRegCircle, FaArrowRight, FaPaintBrush, FaEraser, FaFont, FaUndo, FaRedo, FaDownload, FaCommentDots } from "react-icons/fa";
import boardContext from "../../store/board-context";
import { TOOL_ITEMS } from "../../constants";



const Toolbar = ({ commentMode = false, onToggleCommentMode }) => {
    const { activeToolItem, ChangeToolhandler, undo, redo, canUndo, canRedo } = useContext(boardContext);
    const downloadImage = () => {
        const canvas = document.getElementById("whiteboard-canvas");
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error("Whiteboard canvas is unavailable for download.");
        }

        const downloadLink = document.createElement("a");
        downloadLink.download = "whiteboard.png";
        downloadLink.href = canvas.toDataURL("image/png");
        downloadLink.click();
    };

    return (
        <div className={classes.container}>
            <div 
                className={cx(classes.toolItem, {
                    [classes.active]: activeToolItem === TOOL_ITEMS.BRUSH
                })}
                onClick={() => ChangeToolhandler(TOOL_ITEMS.BRUSH)}    
            >
                <FaPaintBrush />
            </div>
            <div 
                className={cx(classes.toolItem, {
                    [classes.active]: activeToolItem === TOOL_ITEMS.LINE
                })}
                onClick={() => ChangeToolhandler(TOOL_ITEMS.LINE)}    
            >
                <FaSlash />
            </div>
            <div
                className={cx(classes.toolItem, {
                    [classes.active]: activeToolItem === TOOL_ITEMS.RECTANGLE
                })}
                onClick={() => ChangeToolhandler(TOOL_ITEMS.RECTANGLE)}    
            >
                <LuRectangleHorizontal />
            </div>
            <div
                className={cx(classes.toolItem, {
                    [classes.active]: activeToolItem === TOOL_ITEMS.CIRCLE
                })}
                onClick={() => ChangeToolhandler(TOOL_ITEMS.CIRCLE)}    
            >
                <FaRegCircle />
            </div>
            <div
                className={cx(classes.toolItem, {
                    [classes.active]: activeToolItem === TOOL_ITEMS.ARROW
                })}
                onClick={() => ChangeToolhandler(TOOL_ITEMS.ARROW)}    
            >
                <FaArrowRight />
            </div>
            <div
                className={cx(classes.toolItem, {
                    [classes.active]: activeToolItem === TOOL_ITEMS.ERASER
                })}
                onClick={() => ChangeToolhandler(TOOL_ITEMS.ERASER)}
            >
                <FaEraser />
            </div>
            <div
                className={cx(classes.toolItem, {
                    [classes.active]: activeToolItem === TOOL_ITEMS.TEXT
                })}
                onClick={() => ChangeToolhandler(TOOL_ITEMS.TEXT)}
                title="Text"
                role="button"
                tabIndex={0}
            >
                <FaFont />
            </div>
            <div
                className={cx(classes.toolItem, {[classes.disabled]: !canUndo})}
                onClick={() => canUndo && undo()}
                title="Undo"
                aria-label="Undo"
                role="button"
                aria-disabled={!canUndo}
                tabIndex={canUndo ? 0 : -1}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (canUndo) undo();
                    }
                }}
            >
                <FaUndo />
            </div>
            <div
                className={cx(classes.toolItem, {[classes.disabled]: !canRedo})}
                onClick={() => canRedo && redo()}
                title="Redo"
                aria-label="Redo"
                role="button"
                aria-disabled={!canRedo}
                tabIndex={canRedo ? 0 : -1}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (canRedo) redo();
                    }
                }}
            >
                <FaRedo />
            </div>
            {onToggleCommentMode && (
                <button
                    className={cx(classes.toolItem, {
                        [classes.active]: commentMode,
                    })}
                    onClick={onToggleCommentMode}
                    title={commentMode ? "Exit comment mode" : "Add comment"}
                    aria-label={commentMode ? "Exit comment mode" : "Add comment"}
                    aria-pressed={commentMode}
                    type="button"
                >
                    <FaCommentDots />
                </button>
            )}
            <button
                className={classes.downloadButton}
                onClick={downloadImage}
                title="Download PNG"
                aria-label="Download PNG"
                type="button"
            >
                <FaDownload />
            </button>
        </div>
    )
}

export default Toolbar;