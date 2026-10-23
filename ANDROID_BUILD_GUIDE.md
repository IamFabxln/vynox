# Guía de Compilación APK para Android — Vynox Play

Este proyecto cuenta con **Capacitor** completamente configurado y la estructura nativa en la carpeta `android/` lista para generar el archivo APK instalable o la versión firmada para distribución.

---

## 📱 Parámetros de la Aplicación

- **Nombre de la App:** Vynox Play
- **Package ID / Application ID:** `com.stellarxly.vynoxplay`
- **SDK Mínimo:** Android 7.0 (API 24)
- **Target SDK:** Android 14+ (API 36)
- **Arquitectura:** Capacitor 8 + Web assets optimizados con Vite
- **Soporte de Audio:** WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, soporte de streaming HTTPS y CleartextTraffic para desarrollo.

---

## 🚀 Método 1: Compilar con Android Studio (Recomendado)

1. Abre **Android Studio**.
2. Selecciona **Open** (Abrir proyecto) y navega hasta la carpeta `android/` de este repositorio.
3. Espera a que Gradle descargue las dependencias y sincronice el proyecto.
4. Para generar un **APK de depuración/instalación inmediata**:
   - En el menú superior: `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.
   - Una vez finalizado, haz clic en **locate** para encontrar `app-debug.apk`.
   - Puedes copiar este archivo directamente a tu teléfono Android e instalarlo.
5. Para generar un **APK firmado para producción**:
   - En el menú superior: `Build` > `Generate Signed Bundle / APK...`.
   - Selecciona **APK** y haz clic en **Next**.
   - Elige tu almacén de claves (keystore) existente o crea uno nuevo con `Create new...`.
   - Selecciona la variante `release` y haz clic en **Finish**.

---

## 💻 Método 2: Compilar por Línea de Comandos (Terminal)

### Requisitos previos:
- **Node.js** (v18 o superior)
- **Java Development Kit (JDK 17 o 21)**
- **Android SDK Platform Tools & Build Tools** (`ANDROID_HOME` configurado en tus variables de entorno)

### Pasos:

1. **Sincronizar cambios web con Android:**
   ```bash
   npm run cap:build
   ```

2. **Generar APK Debug instalable:**
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   El archivo APK se genera en:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

3. **Generar APK Release (firmado con clave personalizada):**
   Si deseas firmar la aplicación mediante variables de entorno:
   ```bash
   export KEYSTORE_PATH="/ruta/a/tu_keystore.jks"
   export KEYSTORE_PASSWORD="tu_password_keystore"
   export KEY_ALIAS="vynox_key"
   export KEY_PASSWORD="tu_password_key"
   
   cd android
   ./gradlew assembleRelease
   ```
   El archivo APK firmado se genera en:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

---

## 🔑 Cómo crear una Clave de Firma (Keystore)

Si aún no tienes una clave para firmar la app, puedes crear una ejecutando:

```bash
keytool -genkey -v -keystore vynox-release.keystore -alias vynox_key -keyalg RSA -keysize 2048 -validity 10000
```

---

## ☁️ Método 3: Compilación Automática en GitHub Actions

Se ha incluido un flujo de trabajo listo en `.github/workflows/build-apk.yml`. 
Al subir el repositorio a GitHub, la acción compilará el archivo `app-debug.apk` automáticamente y lo dejará disponible en la pestaña **Actions** para su descarga.
