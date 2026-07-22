<?php
// Copia este archivo como config.php y llena tus valores reales.
// config.php NO se sube al repositorio (equivalente al .env del backend Node).

return [
    'db' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'database' => 'embarques_db',
        'user'     => 'root',
        'password' => '',
    ],
    'jwt_secret' => 'dev_secret',
    // Carpeta donde se guardan los PDF de romaneaje — FUERA del document
    // root (public/) para que Apache no los sirva directo sin autenticación.
    'uploads_dir' => __DIR__ . '/../../uploads/romaneajes',
];
