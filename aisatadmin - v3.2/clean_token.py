from PyQt5.QtCore import QSettings

# Initialize settings
settings = QSettings("AISAT", "AdminPanel")

# Remove token
settings.remove("auth_token")
settings.sync()

print("Token successfully removed!")