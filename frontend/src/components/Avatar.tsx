type Props = {
  mode: "speaking" | "listening" | "idle" | "thinking";
};

export function Avatar({ mode }: Props) {
  return (
    <div className={`avatar avatar--${mode}`} aria-hidden>
      <div className="avatar__head">
        <div className="avatar__hair" />
        <div className="avatar__brow avatar__brow--left" />
        <div className="avatar__brow avatar__brow--right" />
        <span className="avatar__eye avatar__eye--left">
          <i />
        </span>
        <span className="avatar__eye avatar__eye--right">
          <i />
        </span>
        <span className="avatar__nose" />
        <span className="avatar__mouth">
          <i />
        </span>
        <span className="avatar__chin" />
      </div>
      <p className="avatar__label">AI Interviewer</p>
    </div>
  );
}
