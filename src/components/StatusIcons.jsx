import React from 'react';

export const SuccessIcon = ({ size = 64 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 100 100"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className="status-icon success-icon"
	>
		<circle cx="50" cy="50" r="48" stroke="#1f4a1f" strokeWidth="4" />
		<path
			d="M25 50 L45 70 L75 30"
			stroke="#2e8b2e"
			strokeWidth="8"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ filter: 'drop-shadow(0px 0px 8px #2e8b2e)' }}
		/>
	</svg>
);

export const FailIcon = ({ size = 64 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 100 100"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className="status-icon fail-icon"
	>
		<circle cx="50" cy="50" r="48" stroke="#4a1f1f" strokeWidth="4" />
		<path
			d="M30 30 L70 70 M70 30 L30 70"
			stroke="#8b0000"
			strokeWidth="8"
			strokeLinecap="round"
			style={{ filter: 'drop-shadow(0px 0px 8px #ff0000)' }}
		/>
	</svg>
);
