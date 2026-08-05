"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 后台通用确认对话框。
 * 手机浏览器（尤其微信内置浏览器和各类 WebView）会拦截 window.confirm，
 * 导致删除等危险操作在移动端静默失效，因此统一使用自绘对话框。
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认删除",
  cancelText = "取消",
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[#303731]">{title}</h3>
        {description ? <p className="mt-3 text-sm leading-6 text-[#6c746f]">{description}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-[#d8d0c4] px-4 py-2 text-sm text-[#59635d] disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-[#a64550] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "处理中…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
