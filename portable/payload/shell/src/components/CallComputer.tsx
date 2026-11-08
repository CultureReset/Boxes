/** "Call my computer": opens the owner-only /door/pccall/ page (node-pccall service, ~/agents/node-pccall).
 *  Phone mic -> dedicated Chrome's virtual mic; that Chrome's voice reply -> phone. Kept separate from in-app voice. */
export function CallComputer() {
  return (
    <a href="/door/pccall/" style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: "8px 12px", padding: "10px 16px",
      borderRadius: 999, background: "#1fae5b", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
      📞 Call my computer
    </a>
  );
}
