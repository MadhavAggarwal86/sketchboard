import { createContext } from "react";

const boardContext = createContext({
    activeToolItem: "",
    toolActionType: "",
    elements: [],
    editingTextId: null,
    BoardMouseDownhandler: () => {},
    ChangeToolhandler: () => {},
    BoardMouseMovehandler: () => {},
    BoardMouseUpHandler: () => {},
    textAreaBlurHandler: () => {},
    cancelTextHandler: () => {},
    undo: () => {},
    redo: () => {},
    canUndo: false,
    canRedo: false,
});

export default boardContext;