const BASE_URL = "https://v2.ly.govapi.tw";

export interface RawBill {
  屆: number;
  議案編號: string;
  議案名稱: string;
  議案類別: string;
  提案來源: string;
  "提案單位/提案委員": string;
  提案人: string[] | null;
  議案狀態: string;
  最新進度日期?: string;
  "法律編號:str"?: string[];
  url: string;
}

export interface RawLegislator {
  屆: number;
  委員姓名: string;
  黨籍: string;
  黨團?: string;
}

export interface BillProcessEntry {
  狀態: string;
  日期: string[];
  "院會/委員會"?: string;
}

export interface BillAttachment {
  名稱: string;
  網址: string;
}

export interface BillRelatedBill {
  議案編號: string;
  議案名稱: string;
}

export interface BillDetail {
  議案編號: string;
  案由?: string;
  提案日期?: string;
  說明?: string;
  連署人?: string[];
  議案流程?: BillProcessEntry[];
  關連議案?: BillRelatedBill[];
  相關附件?: BillAttachment[];
  url: string;
}

interface BillsResponse {
  total: number;
  total_page: number;
  page: number;
  limit: number;
  bills: RawBill[];
}

interface LegislatorsResponse {
  total: number;
  legislators: RawLegislator[];
}

interface BillDetailResponse {
  error: boolean;
  data: BillDetail;
}

export async function fetchAllBills(
  term: number,
  pageSize = 100,
  extraParams: Record<string, string> = {}
): Promise<RawBill[]> {
  const all: RawBill[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      屆: String(term),
      limit: String(pageSize),
      page: String(page),
      ...extraParams,
    });
    const res = await fetch(`${BASE_URL}/bills?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`LY API error ${res.status} on bills page ${page}`);
    }
    const data = (await res.json()) as BillsResponse;
    all.push(...data.bills);

    if (page >= data.total_page || data.bills.length === 0) break;
    page += 1;
  }

  return all;
}

export async function fetchAllLegislators(term: number): Promise<RawLegislator[]> {
  const params = new URLSearchParams({ 屆: String(term), limit: "200" });
  const res = await fetch(`${BASE_URL}/legislators?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`LY API error ${res.status} on legislators`);
  }
  const data = (await res.json()) as LegislatorsResponse;
  return data.legislators;
}

export async function fetchBillDetail(id: string): Promise<BillDetail> {
  const res = await fetch(`${BASE_URL}/bills/${id}`);
  if (!res.ok) {
    throw new Error(`LY API error ${res.status} on bill detail ${id}`);
  }
  const data = (await res.json()) as BillDetailResponse;
  return data.data;
}
