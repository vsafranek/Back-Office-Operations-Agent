export default function HomePage() {
  return (
    <main>
      <h1>Back Office Operations Agent</h1>
      <p>
        API endpoint pro agenta je dostupny na <code>/api/agent</code>.
      </p>
      <ul>
        <li>
          <a href="/auth/register">Registrace</a>
        </li>
        <li>
          <a href="/auth/login">Přihlášení</a>
        </li>
        <li>
          <a href="/dashboard">Dashboard</a>
        </li>
      </ul>
    </main>
  );
}
