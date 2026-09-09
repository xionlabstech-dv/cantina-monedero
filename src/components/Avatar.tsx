export function Avatar({
  fotoUrl,
  nombre,
  size = "md",
  onClick,
}: {
  fotoUrl: string | null;
  nombre: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}) {
  const dims = { sm: "h-9 w-9 text-sm", md: "h-14 w-14 text-lg", lg: "h-20 w-20 text-2xl" }[
    size
  ];
  const initials = nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nombre}
        onClick={onClick}
        className={`${dims} rounded-full object-cover border border-line shrink-0 ${
          onClick ? "cursor-pointer" : ""
        }`}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-full bg-accent-soft text-accent flex items-center justify-center font-semibold shrink-0`}
    >
      {initials}
    </div>
  );
}
