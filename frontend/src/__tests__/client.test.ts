import { api, ApiError, refreshSession, request, tokenStore } from "../api/client";

const json = (status: number, body?: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response);

let fetchMock: jest.Mock;

beforeEach(() => {
  localStorage.clear();
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("request", () => {
  it("sends the bearer token and builds the query string", async () => {
    tokenStore.set("access-1", "refresh-1");
    fetchMock.mockReturnValueOnce(json(200, { ok: true }));

    await request("/api/vehicles", { query: { page: 2, search: "abc", status: "" } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/vehicles?page=2&search=abc");
    expect(init.headers.Authorization).toBe("Bearer access-1");
  });

  it("throws ApiError with the server's message", async () => {
    fetchMock.mockReturnValueOnce(json(400, { error: { code: "BAD_REQUEST", message: "Validation failed" } }));
    await expect(request("/api/x")).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST", message: "Validation failed" });
  });

  it("returns undefined for 204", async () => {
    fetchMock.mockReturnValueOnce(json(204));
    await expect(request("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    tokenStore.set("expired", "refresh-1");
    fetchMock
      .mockReturnValueOnce(json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }))
      .mockReturnValueOnce(json(200, { accessToken: "fresh", refreshToken: "refresh-2", user: {} }))
      .mockReturnValueOnce(json(200, { data: 1 }));

    const result = await request<{ data: number }>("/api/vehicles");

    expect(result).toEqual({ data: 1 });
    expect(tokenStore.access()).toBe("fresh");
    expect(tokenStore.refresh()).toBe("refresh-2");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer fresh");
  });

  it("clears the session when the refresh fails", async () => {
    tokenStore.set("expired", "bad-refresh");
    fetchMock
      .mockReturnValueOnce(json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }))
      .mockReturnValueOnce(json(401, { error: { code: "UNAUTHORIZED", message: "revoked" } }))
      .mockReturnValueOnce(json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }));

    await expect(request("/api/vehicles")).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.access()).toBeNull();
    expect(tokenStore.refresh()).toBeNull();
  });
});

describe("refreshSession", () => {
  it("shares one refresh between parallel callers", async () => {
    tokenStore.set("a", "r");
    fetchMock.mockReturnValue(json(200, { accessToken: "a2", refreshToken: "r2", user: {} }));

    const [one, two] = await Promise.all([refreshSession(), refreshSession()]);

    expect(one && two).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false without a refresh token", async () => {
    await expect(refreshSession()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("api.login / api.logout", () => {
  it("stores tokens after login", async () => {
    fetchMock.mockReturnValueOnce(json(200, { accessToken: "A", refreshToken: "R", user: { id: "1" } }));
    await api.login("a@b.c", "pw");
    expect(tokenStore.access()).toBe("A");
    expect(tokenStore.refresh()).toBe("R");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("clears local tokens even if the server call fails", async () => {
    tokenStore.set("A", "R");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await api.logout();
    expect(tokenStore.access()).toBeNull();
  });
});
