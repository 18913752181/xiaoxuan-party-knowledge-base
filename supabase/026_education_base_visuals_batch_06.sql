-- education-base-visuals 第 6 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (86, '/images/education-bases/base-86-hengli-group-showroom-cover.webp', '恒力集团展示馆主题插画', 'https://www.stdaily.com/web/gdxw/2024-06/16/content_1964198.html', 'reference-only'),
  (93, '/images/education-bases/base-93-zhonganqiao-xiejialu-cover.webp', '众安桥村谢家路主题插画', 'https://nyncj.suzhou.gov.cn/gxnz/gzdt/202304/279e9cc36c424bc7b833d2a5515dda8d.shtml', 'reference-only'),
  (125, '/images/education-bases/base-125-zhaojiaxiang-community-hub-cover.webp', '工业园区金鸡湖街道兆佳巷党群服务中心主题插画', 'https://www.dreamport.com.cn/cases/8.html', 'reference-only'),
  (142, '/images/education-bases/base-142-dushuhu-youth-venture-port-cover.webp', '独墅湖青创港主题插画', 'https://www.sipac.gov.cn/szgyyq/tsyq/202601/293e0d5c7ae040fa9caeb09011513812.shtml', 'reference-only'),
  (146, '/images/education-bases/base-146-sip-exhibition-center-cover.webp', '苏州工业园区展示中心主题插画', 'https://www.artsgroup.cn/en/ennews/engoodNews/2024-04-22/811.html', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
