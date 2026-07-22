<?php
// Router minimalista con soporte de :params, sin dependencias externas.
// Cada archivo routes/*.php recibe una instancia y registra sus rutas en
// el mismo orden de especificidad que su equivalente Express — las rutas
// más específicas (ej. /tipos-ganado) deben registrarse ANTES que las
// genéricas (ej. /:id) dentro del mismo archivo.

class Router {
    private array $routes = [];

    public function get(string $pattern, callable $handler): void { $this->add('GET', $pattern, $handler); }
    public function post(string $pattern, callable $handler): void { $this->add('POST', $pattern, $handler); }
    public function put(string $pattern, callable $handler): void { $this->add('PUT', $pattern, $handler); }
    public function delete(string $pattern, callable $handler): void { $this->add('DELETE', $pattern, $handler); }

    private function add(string $method, string $pattern, callable $handler): void {
        $this->routes[] = [$method, $pattern, $handler];
    }

    // Regresa true si alguna ruta matcheó (el propio handler termina la
    // ejecución vía jsonResponse/jsonError, igual que res.json() en Express).
    public function dispatch(string $method, string $path): bool {
        foreach ($this->routes as [$m, $pattern, $handler]) {
            if ($m !== $method) continue;
            $params = $this->match($pattern, $path);
            if ($params !== null) {
                call_user_func($handler, $params);
                return true;
            }
        }
        return false;
    }

    private function match(string $pattern, string $path): ?array {
        $patternParts = explode('/', trim($pattern, '/'));
        $pathParts = explode('/', trim($path, '/'));
        if (count($patternParts) !== count($pathParts)) return null;

        $params = [];
        foreach ($patternParts as $i => $part) {
            if (strlen($part) > 0 && $part[0] === ':') {
                $params[substr($part, 1)] = $pathParts[$i];
            } elseif ($part !== $pathParts[$i]) {
                return null;
            }
        }
        return $params;
    }
}
