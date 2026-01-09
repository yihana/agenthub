import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/utility.css';

const ErrorPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="error-page">
      <h1>페이지를 표시할 수 없습니다.</h1>
      <p>잠시 후 다시 시도하시거나 메인 화면으로 이동해 주세요.</p>
      <button className="error-button" onClick={() => navigate('/')}>
        메인으로 이동
      </button>
    </div>
  );
};

export default ErrorPage;

