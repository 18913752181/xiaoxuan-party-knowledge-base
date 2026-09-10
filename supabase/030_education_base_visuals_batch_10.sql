-- education-base-visuals 第 10 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (120, '/images/education-bases/base-120-tongcheng-party-cover.webp', '同程网党委主题插画', 'https://www.ly.com/news/detail-66140.html', 'reference-only'),
  (128, '/images/education-bases/base-128-linglong-bay-community-cover.webp', '玲珑湾社区党群服务中心主题插画', 'https://www.sipac.gov.cn/szgyyq/dthg202408/202408/ae396faff64e45c091f68c1514dc95cd.shtml', 'reference-only'),
  (129, '/images/education-bases/base-129-xingwan-red-steward-cover.webp', '星湾社区“红色管家”示范点主题插画', 'https://www.sipac.gov.cn/szgyyq/dthg202407/202407/5cc02fdd82f8485783039e18ed208463.shtml', 'reference-only'),
  (130, '/images/education-bases/base-130-jinji-summit-cover.webp', '“金楫之巅”国金中心党群服务中心主题插画', 'https://www.sipac.gov.cn/szgyyq/dthg202404/202404/37108852b6e444fda6ff10e76ea2f1cf.shtml', 'reference-only'),
  (140, '/images/education-bases/base-140-higer-bus-cover.webp', '金龙客车主题插画', 'https://www.xmklm.com.cn/tzqy/szjl.htm', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
