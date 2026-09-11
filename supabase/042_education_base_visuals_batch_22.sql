-- education-base-visuals 第 22 批：7 个用户提供照片并通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (16, '/images/education-bases/base-16-youyou-neimalu-cover.webp', '姑苏区吴门桥街道“悠悠内马路”新就业群体服务中心主题插画', null, 'reference-only'),
  (28, '/images/education-bases/base-28-gusu-party-history-cover.webp', '姑苏区党史陈列展示馆主题插画', null, 'reference-only'),
  (52, '/images/education-bases/base-52-kunshan-red-academy-cover.webp', '昆山高新区红学院党群服务中心主题插画', null, 'reference-only'),
  (73, '/images/education-bases/base-73-taicang-port-party-center-cover.webp', '太仓港党建领航中心主题插画', null, 'reference-only'),
  (97, '/images/education-bases/base-97-taihu-new-city-builders-home-cover.webp', '吴中太湖新城建设者新家园党群服务中心主题插画', null, 'reference-only'),
  (118, '/images/education-bases/base-118-jinpu-drawing-lounge-cover.webp', '“金浦绘客厅”设计小镇党群服务中心主题插画', null, 'reference-only'),
  (126, '/images/education-bases/base-126-xingchen-community-party-center-cover.webp', '工业园区胜浦街道星辰社区党群服务中心主题插画', null, 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
