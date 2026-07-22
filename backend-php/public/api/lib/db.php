<?php

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $config = require __DIR__ . '/../config.php';
    $db = $config['db'];
    $dsn = "mysql:host={$db['host']};port={$db['port']};dbname={$db['database']};charset=utf8mb4";

    $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

function config(): array {
    static $config = null;
    if ($config === null) $config = require __DIR__ . '/../config.php';
    return $config;
}
