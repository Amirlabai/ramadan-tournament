import './Skeleton.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
  circle?: boolean;
}

export default function Skeleton({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = false,
  circle = false,
}: SkeletonProps) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  const classes = [
    'skeleton-block',
    rounded ? 'skeleton-block--rounded' : '',
    circle ? 'skeleton-block--circle' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes} style={style} aria-hidden="true" />;
}
