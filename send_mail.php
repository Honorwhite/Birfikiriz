<?php
header('Content-Type: application/json');

// Form verilerini al
$email = $_POST['email'];

// Veritabanı işlemleri
$db_path = 'subscribers.db';
$success = false;
$message = '';

try {
    // SQLite veritabanı bağlantısı
    $db = new SQLite3($db_path);
    
    // Tablo yoksa oluştur
    $db->exec('CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        subscribe_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )');
    
    // Email adresini veritabanına kaydet
    $stmt = $db->prepare('INSERT INTO subscribers (email) VALUES (:email)');
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        $success = true;
        $message = 'Abone kaydınız başarıyla oluşturuldu.';
        
        // İsteğe bağlı olarak mail gönderme
        $to = "info@birfikiriz.com";
        $subject = "Yeni Bülten Aboneliği";
        $mail_message = "Yeni bir bülten aboneliği:\n\nE-posta: " . $email . "\n";
        $headers = "From: " . $email . "\r\n";
        $headers .= "Reply-To: " . $email . "\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();
        
        mail($to, $subject, $mail_message, $headers); 
    } else {
        $success = false;
        $message = 'Bir hata oluştu veya bu email adresi zaten kayıtlı.';
    }
    
    // Veritabanı bağlantısını kapat
    $db->close();
    
} catch (Exception $e) {
    $success = false;
    $message = 'Veritabanı hatası: ' . $e->getMessage();
}

// Sonucu JSON olarak döndür
echo json_encode([
    'success' => $success, 
    'message' => $message
]);
?> 