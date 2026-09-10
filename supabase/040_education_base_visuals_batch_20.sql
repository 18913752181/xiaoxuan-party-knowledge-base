-- education-base-visuals 第 20 批：4 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (3, '/images/education-bases/base-3-changshu-new-work-party-center-cover.webp', '常熟市新业态新就业群体党群服务中心主题插画', 'https://paper.people.com.cn/zgcsb/pc/content/202512/08/content_30119296.html', 'reference-only'),
  (6, '/images/education-bases/base-6-ludang-village-party-center-cover.webp', '常熟市沙家浜镇芦荡村党群服务中心主题插画', 'https://www.sohu.com/a/669514361_121106832', 'reference-only'),
  (9, '/images/education-bases/base-9-changshu-civilization-practice-center-cover.webp', '常熟市新时代文明实践中心（常熟市志愿者协会总部）主题插画', 'https://www.wenming.cn/wmsjzx/dfcz/js/202202/t20220211_6293932.shtml', 'reference-only'),
  (76, '/images/education-bases/base-76-dianzhan-village-party-center-cover.webp', '太仓市城厢镇电站村党群服务中心主题插画', 'https://www.sohu.com/a/678059069_121123867', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
