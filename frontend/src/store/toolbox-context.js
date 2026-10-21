import { createContext } from "react";

const toolBoxContext = createContext({
    toolboxState:{},
    changeStroke: ()=>{},
    changeFill: ()=>{},
    changeSize: ()=>{},

})

export default toolBoxContext;