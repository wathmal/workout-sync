const LINKS = ["Privacy", "Security", "Status"];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: "1px solid var(--color-outline)",
        background: "var(--color-surface-base)",
        padding: "20px 24px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
        }}
      >
        © {year} Fit Sync
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {LINKS.map((link) => (
          <span
            key={link}
            className="footer-link"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              transition: "color var(--motion-fast) var(--ease)",
            }}
          >
            {link}
          </span>
        ))}
      </div>
    </footer>
  );
}
