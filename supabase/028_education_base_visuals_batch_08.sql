-- education-base-visuals 第 8 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (8, '/images/education-bases/base-8-jiangxiang-village-cover.webp', '蒋巷村主题插画', 'https://nyncj.suzhou.gov.cn/nlj/tpxw/202601/0eb891b6798e4084b51c267057b425fa.shtml', 'reference-only'),
  (77, '/images/education-bases/base-77-taicang-planning-hall-cover.webp', '太仓市规划展示馆主题插画', 'https://yunghzg.cn/default.aspx/?RoomID=119', 'reference-only'),
  (101, '/images/education-bases/base-101-wushe-practice-center-cover.webp', '吴中区五社融合创新实践中心主题插画', 'https://minzhengju.suzhou.gov.cn/mzj/sqdt/202306/cdd613dd763c40238817020088968b4e.shtml', 'reference-only'),
  (123, '/images/education-bases/base-123-gcl-party-culture-hall-cover.webp', '协鑫党建馆主题插画', 'https://szxq.seu.edu.cn/2023/1123/c24377a473028/pagem.htm', 'reference-only'),
  (124, '/images/education-bases/base-124-north-civic-center-cover.webp', '工业园区唯亭街道北部市民中心党群服务中心主题插画', 'https://www.sipurd.com/product/showproduct.php?id=151&lang=cn', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
