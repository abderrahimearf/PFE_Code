import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Ton adresse Gmail
email_sender = "sqlqueryclm@gmail.com"
# Mot de passe d'application (PAS ton vrai mot de passe Gmail)
email_password = "ztln xamgp mdjd"

# Destinataire


# Créer le message
message = MIMEMultipart()
message["From"] = email_sender
message["To"] = email_receiver
message["Subject"] = "Test email depuis Python"

body = "Bonjour 👋, ceci est un email envoyé avec Python via SMTP."
message.attach(MIMEText(body, "plain"))

# Connexion au serveur SMTP de Gmail
try:
    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()  # Sécuriser la connexion
    server.login(email_sender, email_password)
    
    # Envoyer l'email
    server.send_message(message)
    print("Email envoyé avec succès !")

except Exception as e:
    print("Erreur :", e)

finally:
    server.quit()