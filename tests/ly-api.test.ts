import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllBills, fetchAllLegislators, fetchBillDetail } from "../lib/ly-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAllBills", () => {
  it("paginates until total_page is reached", async () => {
    const page1 = {
      total: 3,
      total_page: 2,
      page: 1,
      limit: 2,
      bills: [{ 議案編號: "1" }, { 議案編號: "2" }],
    };
    const page2 = {
      total: 3,
      total_page: 2,
      page: 2,
      limit: 2,
      bills: [{ 議案編號: "3" }],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });
    vi.stubGlobal("fetch", fetchMock);

    const bills = await fetchAllBills(11, 2);

    expect(bills.map((b) => b.議案編號)).toEqual(["1", "2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstUrl.searchParams.get("屆")).toBe("11");
    expect(firstUrl.searchParams.get("limit")).toBe("2");
    expect(firstUrl.searchParams.get("page")).toBe("1");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    await expect(fetchAllBills(11)).rejects.toThrow(/500/);
  });

  it("includes extraParams in the query string", async () => {
    const page1 = {
      total: 1,
      total_page: 1,
      page: 1,
      limit: 100,
      bills: [{ 議案編號: "1" }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 });
    vi.stubGlobal("fetch", fetchMock);

    await fetchAllBills(11, 100, { 會期: "3" });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("會期")).toBe("3");
  });
});

describe("fetchAllLegislators", () => {
  it("returns the legislators array", async () => {
    const response = {
      total: 1,
      legislators: [{ 屆: 11, 委員姓名: "王委員", 黨籍: "民主進步黨" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    );
    const legislators = await fetchAllLegislators(11);
    expect(legislators).toEqual(response.legislators);
  });
});

describe("fetchBillDetail", () => {
  it("returns the data field from the response", async () => {
    const response = { error: false, data: { 議案編號: "123", 案由: "測試" } };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    );
    const detail = await fetchBillDetail("123");
    expect(detail.議案編號).toBe("123");
    expect(detail.案由).toBe("測試");
  });
});
