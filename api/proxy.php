<?php
/**
 * Secure API Proxy for Bantu Stream Connect
 * Protects Supabase keys from client-side exposure
 */

// Security headers
header("Content-Security-Policy: default-src 'self'");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: strict-origin-when-cross-origin");
header("Permissions-Policy: geolocation=(), microphone=(), camera=()");

// CORS headers (restrict to your domain)
$allowed_origins = ['https://bantustreamconnect.com', 'http://localhost:3000'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Rate limiting (simple implementation)
function rateLimit($key, $limit = 60, $window = 60) {
    $ip = $_SERVER['REMOTE_ADDR'];
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $rateKey = "rate_" . md5($ip . $userAgent . $key);
    
    session_start();
    
    if (!isset($_SESSION[$rateKey])) {
        $_SESSION[$rateKey] = ['count' => 1, 'time' => time()];
        return true;
    }
    
    $data = $_SESSION[$rateKey];
    
    if (time() - $data['time'] > $window) {
        $_SESSION[$rateKey] = ['count' => 1, 'time' => time()];
        return true;
    }
    
    if ($data['count'] >= $limit) {
        http_response_code(429);
        echo json_encode(['error' => 'Rate limit exceeded']);
        return false;
    }
    
    $_SESSION[$rateKey]['count']++;
    return true;
}

// Load environment variables (keep secret!)
$env = parse_ini_file(__DIR__ . '/.env');

// Supabase configuration (from environment variables)
$SUPABASE_URL = $env['SUPABASE_URL'] ?? '';
$SUPABASE_KEY = $env['SUPABASE_ANON_KEY'] ?? '';
$SUPABASE_SERVICE_KEY = $env['SUPABASE_SERVICE_KEY'] ?? '';

// Validate environment
if (empty($SUPABASE_URL) || empty($SUPABASE_KEY)) {
    error_log("Missing Supabase configuration");
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error']);
    exit();
}

// Input validation and sanitization
function validateInput($input) {
    $sanitized = [];
    
    foreach ($input as $key => $value) {
        if (is_string($value)) {
            // Remove potentially harmful characters
            $value = strip_tags($value);
            $value = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
            
            // Validate based on expected type
            switch ($key) {
                case 'category':
                    $allowed = ['movies', 'tv_shows', 'documentaries', 'kids', 'sports', 
                               'news', 'music', 'videos', 'podcasts', 'skits', 'stem'];
                    if (!in_array(strtolower($value), $allowed)) {
                        continue 2; // Skip invalid categories
                    }
                    break;
                    
                case 'limit':
                    $value = intval($value);
                    if ($value < 1 || $value > 100) {
                        $value = 20; // Default
                    }
                    break;
                    
                case 'page':
                    $value = max(1, intval($value));
                    break;
                    
                case 'id':
                    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $value)) {
                        continue 2; // Skip invalid IDs
                    }
                    break;
            }
        }
        $sanitized[$key] = $value;
    }
    
    return $sanitized;
}

// Main request handler
try {
    // Apply rate limiting
    if (!rateLimit('api_request', 60, 60)) {
        exit();
    }
    
    // Get and validate parameters
    $params = validateInput($_GET);
    
    // Build Supabase query
    $queryParams = [];
    $table = 'content'; // Default table
    
    // Determine table based on request
    if (isset($params['type'])) {
        switch ($params['type']) {
            case 'profile':
                $table = 'user_profiles';
                break;
            case 'creator':
                $table = 'creators';
                break;
        }
    }
    
    // Build query string
    $queryUrl = "{$SUPABASE_URL}/rest/v1/{$table}?select=*";
    
    // Add filters
    if (isset($params['category']) && $params['category'] !== 'all') {
        $queryUrl .= "&genre=eq.{$params['category']}";
    }
    
    if (isset($params['status'])) {
        $queryUrl .= "&status=eq.published";
    }
    
    // Add ordering and limits
    $limit = $params['limit'] ?? 20;
    $offset = (($params['page'] ?? 1) - 1) * $limit;
    
    $queryUrl .= "&order=created_at.desc";
    $queryUrl .= "&limit={$limit}";
    $queryUrl .= "&offset={$offset}";
    
    // Make request to Supabase
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $queryUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'apikey: ' . $SUPABASE_KEY,
            'Authorization: Bearer ' . $SUPABASE_KEY,
            'Content-Type: application/json',
            'Prefer: return=representation'
        ],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        throw new Exception("CURL Error: {$error}");
    }
    
    // Process response
    $data = json_decode($response, true);
    
    // Sanitize response data before sending to client
    if (is_array($data)) {
        array_walk_recursive($data, function(&$value) {
            if (is_string($value)) {
                $value = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
            }
        });
    }
    
    // Add caching headers
    header("Cache-Control: public, max-age=3600");
    header("Expires: " . gmdate('D, d M Y H:i:s', time() + 3600) . ' GMT');
    
    // Return JSON response
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'data' => $data,
        'meta' => [
            'count' => count($data),
            'page' => $params['page'] ?? 1,
            'limit' => $limit
        ]
    ]);
    
} catch (Exception $e) {
    // Log error (don't expose details to client)
    error_log("API Error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'An error occurred while fetching data',
        'code' => 'INTERNAL_ERROR'
    ]);
}
?>
