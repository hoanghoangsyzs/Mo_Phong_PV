import interviewerPortrait from "../assets/interviewer-avatar.png";

type Props = {
  mode: "speaking" | "listening" | "idle" | "thinking";
};

export function Avatar({ mode }: Props) {
  return (
    <div className={`avatar avatar--${mode}`} aria-hidden>
      <img className="avatar__portrait" src={interviewerPortrait} alt="" />
    </div>
  );
}
