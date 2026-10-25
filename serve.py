#!/usr/bin/env python3
import http.server
import socket
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Silence logs to keep output clean
        pass

if __name__ == '__main__':
    ip = get_local_ip()
    print("==================================================================")
    print(" 🚀 SERVEUR MOBILE ANTI-CFD ACTIF")
    print("==================================================================")
    print(f" • Sur votre Mac :         http://localhost:{PORT}")
    print(f" • Sur votre iPhone/Android (même Wi-Fi) : http://{ip}:{PORT}")
    print("==================================================================")
    print(" Gardez cette fenêtre ouverte tant que vous utilisez l'application.")
    print("==================================================================")

    try:
        with ReusableTCPServer(('0.0.0.0', PORT), CustomHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrêté.")
