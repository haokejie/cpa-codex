use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64_STD;
use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

pub const APP_FIXED_KEY: &str = "CHANGE_ME_FIXED_API_KEY";

fn derive_key(app_key: &str) -> [u8; 32] {
    let digest = Sha256::digest(app_key.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&digest);
    key
}

pub fn encrypt_password(plain: &str) -> Result<String, String> {
    let key = derive_key(APP_FIXED_KEY);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("初始化加密失败: {e}"))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| format!("加密失败: {e}"))?;

    let mut payload = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&ciphertext);

    Ok(BASE64_STD.encode(payload))
}

pub fn decrypt_password(encoded: &str) -> Result<String, String> {
    let raw = BASE64_STD
        .decode(encoded)
        .map_err(|e| format!("解码密码失败: {e}"))?;

    if raw.len() < 13 {
        return Err("密文格式不正确".to_string());
    }

    let (nonce_bytes, ciphertext) = raw.split_at(12);
    let key = derive_key(APP_FIXED_KEY);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("初始化解密失败: {e}"))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let plain = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("解密失败: {e}"))?;

    String::from_utf8(plain).map_err(|e| format!("解密后内容异常: {e}"))
}
