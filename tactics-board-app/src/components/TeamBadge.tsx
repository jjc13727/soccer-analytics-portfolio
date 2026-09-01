import { teamInitials } from "../data/nameFormat";

export default function TeamBadge({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="team-badge"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {teamInitials(name)}
    </div>
  );
}
