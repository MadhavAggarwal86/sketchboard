import Board from "./components/Board/index";
import Toolbar from "./components/Toolbar/index";
import Toolbox from "./components/Toolbox";
import BoardProvider from "./store/BoardProvider";
import ToolBoxProvider from "./store/toolboxProvider";


function App() {
  return (
    <BoardProvider>
      <ToolBoxProvider>
        <Toolbar />
        <Board />
        <Toolbox />
      </ToolBoxProvider>
    </BoardProvider>
  );
}

export default App;
