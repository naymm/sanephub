/**
 * URL do visualizador Microsoft Office Online (ficheiro remoto via HTTPS).
 * @see https://view.officeapps.live.com/
 */
export function officeOnlineViewerUrl(publicFileUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(publicFileUrl)}`;
}
