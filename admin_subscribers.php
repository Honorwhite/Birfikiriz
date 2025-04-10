<?php
// Admin oturum kontrolü (gerçek bir projede daha güvenli yapılmalı)
$admin_username = "admin";
$admin_password = "birfikiriz2024"; // Gerçek uygulamada şifrelenmiş olmalı

session_start();

// Oturum kontrolü
$authenticated = false;
if (isset($_POST['username']) && isset($_POST['password'])) {
    if ($_POST['username'] === $admin_username && $_POST['password'] === $admin_password) {
        $_SESSION['admin_authenticated'] = true;
        $authenticated = true;
    }
} elseif (isset($_SESSION['admin_authenticated']) && $_SESSION['admin_authenticated'] === true) {
    $authenticated = true;
}

// Çıkış yapma işlemi
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: admin_subscribers.php');
    exit;
}

// Abone silme işlemi
if ($authenticated && isset($_GET['delete'])) {
    $id = intval($_GET['delete']);
    try {
        $db = new SQLite3('subscribers.db');
        $stmt = $db->prepare('DELETE FROM subscribers WHERE id = :id');
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmt->execute();
        $db->close();
        header('Location: admin_subscribers.php');
        exit;
    } catch (Exception $e) {
        $error_message = 'Silme işleminde hata: ' . $e->getMessage();
    }
}

// Excel'e aktarma işlemi
if ($authenticated && isset($_GET['export'])) {
    try {
        $db = new SQLite3('subscribers.db');
        $results = $db->query('SELECT email, subscribe_date FROM subscribers ORDER BY subscribe_date DESC');
        
        // CSV başlıkları
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=subscribers.csv');
        
        $output = fopen('php://output', 'w');
        fputcsv($output, ['Email', 'Tarih']);
        
        while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
            fputcsv($output, [$row['email'], $row['subscribe_date']]);
        }
        
        fclose($output);
        $db->close();
        exit;
    } catch (Exception $e) {
        $error_message = 'Dışa aktarma hatası: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Birfikiriz - Abone Yönetimi</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #f15a31;
            text-align: center;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f6f6f6;
        }
        .actions {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
        }
        .btn {
            display: inline-block;
            background: #f15a31;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 3px;
            border: none;
            cursor: pointer;
        }
        .btn:hover {
            background: #d14a21;
        }
        .delete-btn {
            background: #ff4444;
        }
        .delete-btn:hover {
            background: #cc0000;
        }
        .login-form {
            display: flex;
            flex-direction: column;
            max-width: 300px;
            margin: 0 auto;
        }
        .login-form input {
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
        }
        .total {
            text-align: right;
            font-weight: bold;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Birfikiriz - Abone Yönetimi</h1>
        
        <?php if (!$authenticated): ?>
            <!-- Giriş Formu -->
            <form method="post" class="login-form">
                <h2>Admin Girişi</h2>
                <?php if (isset($_POST['username'])): ?>
                    <p style="color: red;">Kullanıcı adı veya şifre hatalı!</p>
                <?php endif; ?>
                <input type="text" name="username" placeholder="Kullanıcı Adı" required>
                <input type="password" name="password" placeholder="Şifre" required>
                <button type="submit" class="btn">Giriş Yap</button>
            </form>
        <?php else: ?>
            <!-- Abone Listesi -->
            <div class="actions">
                <a href="admin_subscribers.php?logout=1" class="btn">Çıkış Yap</a>
                <a href="admin_subscribers.php?export=1" class="btn">Excel'e Aktar</a>
            </div>
            
            <?php
            try {
                $db = new SQLite3('subscribers.db');
                $results = $db->query('SELECT * FROM subscribers ORDER BY subscribe_date DESC');
                $total_subscribers = $db->querySingle('SELECT COUNT(*) FROM subscribers');
                
                if ($total_subscribers > 0): 
            ?>
                <div class="total">Toplam Abone: <?php echo $total_subscribers; ?></div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Email</th>
                            <th>Tarih</th>
                            <th>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php while ($row = $results->fetchArray(SQLITE3_ASSOC)): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($row['id']); ?></td>
                            <td><?php echo htmlspecialchars($row['email']); ?></td>
                            <td><?php echo htmlspecialchars($row['subscribe_date']); ?></td>
                            <td>
                                <a href="admin_subscribers.php?delete=<?php echo $row['id']; ?>" 
                                   class="btn delete-btn" 
                                   onclick="return confirm('Bu aboneyi silmek istediğinize emin misiniz?')">Sil</a>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <p>Henüz abone bulunmamaktadır.</p>
            <?php 
                endif;
                $db->close();
            } catch (Exception $e) {
                echo '<p style="color: red;">Veritabanı hatası: ' . $e->getMessage() . '</p>';
            }
            ?>
        <?php endif; ?>
        
        <?php if (isset($error_message)): ?>
            <p style="color: red;"><?php echo $error_message; ?></p>
        <?php endif; ?>
    </div>
</body>
</html> 