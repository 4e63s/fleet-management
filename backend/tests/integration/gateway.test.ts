import http from "http";
import type { AddressInfo } from "net";
import { io as connect, type Socket } from "socket.io-client";
import { createGateway, type Gateway } from "../../src/realtime/gateway";
import { testEnv, tokenFor, ID_A } from "../helpers/testApp";

let server: http.Server;
let gateway: Gateway;
let url: string;
const clients: Socket[] = [];

beforeEach(async () => {
  server = http.createServer();
  gateway = createGateway(server, { jwtSecret: testEnv.JWT_ACCESS_SECRET, corsOrigin: "*" });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  await gateway.close();
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
});

const open = (token?: string) => {
  const socket = connect(url, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
  clients.push(socket);
  return socket;
};

const once = <T>(socket: Socket, event: string) => new Promise<T>((resolve) => socket.once(event, resolve));

describe("socket authentication", () => {
  it("refuses connections without a token", async () => {
    const socket = open();
    const err = await once<Error>(socket, "connect_error");
    expect(err.message).toBe("UNAUTHORIZED");
  });

  it("refuses an invalid token", async () => {
    const socket = open("garbage");
    const err = await once<Error>(socket, "connect_error");
    expect(err.message).toBe("UNAUTHORIZED");
  });
});

describe("broadcasting", () => {
  const position = {
    vehicleId: ID_A,
    plate: "ABC-1234",
    lat: 24.47,
    lng: 39.61,
    speedKph: 50,
    heading: 90,
    recordedAt: "2026-06-06T00:00:00.000Z"
  };

  it("delivers position updates to authenticated clients", async () => {
    const socket = open(tokenFor("DRIVER"));
    await once(socket, "connect");
    await new Promise((r) => setTimeout(r, 25));

    const received = once<typeof position>(socket, "position:update");
    gateway.bus.emitPosition(position);

    await expect(received).resolves.toEqual(position);
  });

  it("delivers alerts and health events too", async () => {
    const socket = open(tokenFor("MANAGER"));
    await once(socket, "connect");
    await new Promise((r) => setTimeout(r, 25));

    const alert = once<{ type: string }>(socket, "alert:new");
    const health = once<{ healthScore: number }>(socket, "health:update");

    gateway.bus.emitAlert({ id: "a1", vehicleId: ID_A, plate: "ABC-1234", type: "LOW_FUEL", severity: "WARNING", message: "low", createdAt: "2026-06-06T00:00:00.000Z" });
    gateway.bus.emitHealth({
      vehicleId: ID_A,
      plate: "ABC-1234",
      engineTempC: 90,
      fuelLevelPct: 50,
      batteryVoltage: 12.5,
      tirePressureKpa: 230,
      oilLifePct: 70,
      healthScore: 100,
      recordedAt: "2026-06-06T00:00:00.000Z"
    });

    expect((await alert).type).toBe("LOW_FUEL");
    expect((await health).healthScore).toBe(100);
  });
});
