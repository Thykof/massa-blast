import { generateExplorerLink } from '../../utils/massa-utils';

type OperationToastProps = {
  title: string;
  operationId?: string;
};

export function OperationToast({ title, operationId }: OperationToastProps) {
  return (
    <div className="inline-flex mas-h2 text-center items-between justify-center">
      <p className="mas-body mr-4">{title}</p>
      {operationId && (
        <a
          href={generateExplorerLink(operationId)}
          target="_blank"
          rel="noreferrer"
          className="mas-caption-underline self-center mr-3"
        >
          Explorer
        </a>
      )}
    </div>
  );
}
