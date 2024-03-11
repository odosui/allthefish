export const TaskInProgress = ({ title }: { title: string }) => {
  return (
    <div className="task-in-progress">
      <span className="loader"></span>
      <div>{title}</div>
    </div>
  );
};
