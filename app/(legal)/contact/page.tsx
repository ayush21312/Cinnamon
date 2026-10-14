export default function Contact() {
  const email = process.env.CONTACT_EMAIL;
  return (
    <>
      <h1>Contact</h1>
      <p>For game feedback, word-list corrections, or privacy questions:</p>
      {email ? (
        <p>
          <a href={`mailto:${email}`}>{email}</a>
        </p>
      ) : (
        <>
          <p className="contact-placeholder">contact@example.com</p>
          <p>
            This is a placeholder, not a working contact address. Contact details have not been
            published yet. Do not send personal information to this address.
          </p>
        </>
      )}
    </>
  );
}
