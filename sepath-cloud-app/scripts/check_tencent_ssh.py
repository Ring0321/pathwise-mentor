import socket
import struct


def read_exact(sock, count):
    result = b""
    while len(result) < count:
        part = sock.recv(count - len(result))
        if not part:
            raise ConnectionError("Connection closed before SSH banner")
        result += part
    return result


def connect(proxy=False):
    destination = "212.129.243.63"
    sock = socket.create_connection(("127.0.0.1", 7892) if proxy else (destination, 22), timeout=8)
    if proxy:
        sock.sendall(b"\x05\x01\x00")
        if read_exact(sock, 2) != b"\x05\x00":
            raise ConnectionError("SOCKS negotiation unavailable")
        sock.sendall(b"\x05\x01\x00\x01" + socket.inet_aton(destination) + struct.pack("!H", 22))
        response = read_exact(sock, 4)
        if response[1] != 0:
            raise ConnectionError("SOCKS connection refused")
        length = 4 if response[3] == 1 else 16 if response[3] == 4 else read_exact(sock, 1)[0]
        read_exact(sock, length + 2)
    return sock


if __name__ == "__main__":
    for mode in (False, True):
        try:
            with connect(mode) as channel:
                banner = channel.recv(256).decode("ascii", errors="replace").strip()
                print({"path": "proxy" if mode else "direct", "banner": banner or "connection_closed"}, flush=True)
        except Exception as exc:
            print({"path": "proxy" if mode else "direct", "error": str(exc)}, flush=True)
