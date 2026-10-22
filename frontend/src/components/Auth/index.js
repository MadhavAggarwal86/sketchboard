import { useState } from "react";
import { register, signIn } from "../../api/auth";
import classes from "./index.module.css";

const Auth = ({ onAuthenticated }) => {
  const [registering, setRegistering] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = registering
        ? await register({ first_name: firstName, last_name: lastName, email, password })
        : await signIn({ email, password });
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={classes.page}>
      <form className={classes.card} onSubmit={submit}>
        <h1>Whiteboard</h1>
        <p>{registering ? "Create an account to save your boards." : "Sign in to open your boards."}</p>
        {registering && (
          <label>
            First name
            <input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
          </label>
        )}
        {registering && (
          <label>
            Last name
            <input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={registering ? 8 : undefined}
            required
          />
          {registering && <small>Use at least 8 characters, including lowercase, uppercase, number, and symbol.</small>}
        </label>
        {error && <div className={classes.error} role="alert">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
        <button
          className={classes.switch}
          type="button"
          onClick={() => {
            setRegistering(!registering);
            setError("");
          }}
        >
          {registering ? "Already have an account? Sign in" : "Need an account? Register"}
        </button>
      </form>
    </main>
  );
};

export default Auth;
