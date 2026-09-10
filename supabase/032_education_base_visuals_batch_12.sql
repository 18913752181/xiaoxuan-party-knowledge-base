-- education-base-visuals 第 12 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (4, '/images/education-bases/base-4-bosideng-linghang-cover.webp', '波司登集团领航党群服务中心主题插画', 'https://news.pku.edu.cn/xwzh/8e0456327b294d0daa9d1b93071411a8.htm', 'reference-only'),
  (11, '/images/education-bases/base-11-zhou-xinmin-studio-cover.webp', '苏州高新区周新民党建工作室主题插画', 'https://frontier.nju.edu.cn/19/ad/c59140a727469/pagem.htm', 'reference-only'),
  (104, '/images/education-bases/base-104-faith-360-theatre-cover.webp', '国内首部全景影秀剧《信仰》主题插画', 'https://szredcross.suzhou.gov.cn/index.php/home/mb/xwzxcontent?id=8756', 'reference-only'),
  (131, '/images/education-bases/base-131-yuanrong-constellation-cover.webp', '圆融星座党群服务中心主题插画', 'https://jinjilake.sipac.gov.cn/upload/202407/09/202407090929379124.pdf', 'reference-only'),
  (134, '/images/education-bases/base-134-night-economy-center-cover.webp', '苏州工业园区“夜经济”党群服务中心主题插画', 'https://jinjilake.sipac.gov.cn/upload/202503/06/202503061015302176.pdf', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
