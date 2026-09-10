-- education-base-visuals 第 5 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (40, '/images/education-bases/base-40-kunshan-archives-cover.webp', '“玉出昆冈——昆山历史文化档案陈列”展（昆山市档案馆）主题插画', 'https://article.xuexi.cn/html/9665123514958921389.html', 'reference-only'),
  (92, '/images/education-bases/base-92-taihu-snow-culture-park-cover.webp', '太湖雪蚕桑文化园主题插画', 'https://taihusnow.com/taihu-snow-silkworm-garden-silk-road-theme-park.html', 'reference-only'),
  (106, '/images/education-bases/base-106-fengmenglong-village-cover.webp', '相城区黄埭镇冯梦龙村主题插画', 'https://nyncj.suzhou.gov.cn/nlj/sqdt/202112/1355f14a31d9478ba9874a38214f766e.shtml', 'reference-only'),
  (109, '/images/education-bases/base-109-xiangcheng-planning-hall-cover.webp', '苏州相城区规划展示馆主题插画', 'https://www.designboom.com/architecture/lacime-architects-cover-exhibition-hall-undulating-facade-suzhou-china-11-03-2018/', 'reference-only'),
  (143, '/images/education-bases/base-143-suzhou-fund-museum-cover.webp', '苏州基金博物馆主题插画', 'https://you.ctrip.com/sight/suzhou11/1487567.html', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
