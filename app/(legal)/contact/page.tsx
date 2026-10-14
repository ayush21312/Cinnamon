export default function Contact() {
  const email = process.env.CONTACT_EMAIL;
  return (
    <>
      <h1>Contact</h1>
      <p>For feedback or questions:</p>
      {email ? (
        <p>
          <a href={`mailto:${email}`}>{email}</a>
        </p>
      ) : (
        <>
          <p className="contact-placeholder">contact@example.com</p>
        </>
      )}
    </>
  );
}
