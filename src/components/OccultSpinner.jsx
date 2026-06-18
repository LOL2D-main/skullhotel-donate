import React from 'react';

export default function OccultSpinner({ size = 64 }) {
	return (
		<div className="occult-spinner" style={{ width: size, height: size }}>
			<svg
				viewBox="0 0 100 100"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="occult-spinner-svg"
			>
				{/* Outer Circle */}
				<circle cx="50" cy="50" r="48" stroke="#8b0000" strokeWidth="2" strokeDasharray="10 4" />
				{/* Inner pentagram-ish geometry */}
				<path
					d="M50 5 L93 36 L76 86 L24 86 L7 36 Z"
					stroke="#ff0000"
					strokeWidth="2"
					fill="none"
				/>
				{/* Inner eye / circle */}
				<circle cx="50" cy="50" r="15" stroke="#ff0000" strokeWidth="2" />
				<circle cx="50" cy="50" r="5" fill="#ff0000" />
			</svg>
		</div>
	);
}
