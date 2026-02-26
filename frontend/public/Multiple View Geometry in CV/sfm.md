有摄像机A，B；点P，Q；  
P在A坐标系坐标$P_A$，Q在B坐标系坐标$Q_B$  
P、Q在世界坐标系坐标$P_W$$Q_W$  
$P_A^T E Q_B=0$  
$P_W^T F Q_W=0$  
  
  
### 标定重建  
已知有N组对应点的世界坐标，求摄像机外参：  
方程组  
  
$$  
\begin{gathered}  
z_i \cdot f = 0 \\  
i \in \{1,2,…,N\}  
\end{gathered}  
$$  
对于摄像机$c_0$ $c_1$坐标系下一组点$x_{i0}$ $x_{i1}$  
$z_i$ 为$\mathbf{x_{i1}} \mathbf{x_{i0}}^T$向量化，$f$为本质矩阵E的向量化  
写成矩阵乘法  
  
$$Af=0$$  
SVD求解  
（A需要为至少$7*9$，……）  
  
即可得到E  
（可以通过重归一化方法减小误差）  
  
  
对E进行SVD分解，  
  
$$E=U\Sigma V^T=  
\left[  
	\begin{matrix}  
	u_0& u_1 & \hat{t}  
	\end{matrix}  
	\right]  
\left[  
	\begin{matrix}  
	1 & & \\ & 1 & \\ & & 0  
		\end{matrix}  
	\right]  
	\left[  
	\begin{matrix}  
	v_0^T\\ v_1^T \\v_2^T  
	\end{matrix}  
	\right]$$   
  	  
$$  
	\begin{gathered}  
	W = \begin{bmatrix}  
0 & -1 & 0 \\  
1 & 0 & 0 \\  
0 & 0 & 1  
\end{bmatrix} 为绕z轴旋转90度的旋转矩阵  
\\ \\  
可能的旋转矩阵：R_1 = \pm U W V^T, \quad R_2 =\pm U W^T V^T \\ \\  
可能的平移向量：t_1 = \hat{t}, \quad t_2 = -\hat{t} \\ \\  
\mathbf{P}_2 = R \mathbf{P}_1 + t \\ \\  
筛选最优Rt规则：\\|R|=1\\  
计算出的P正手性的比例最大  
	\end{gathered}  
$$  
  
  
  
投影重建（未标定）类似  
  
$$  
F=K_1^{-T} E K_0^{-1}=K_1^{-T} [t]_{\times} R K_0^{-1}  
$$  
  
  
$$  
F=[e]_{\times} \tilde{H}  
=[e]_{\times} K_1^{-T}  R K_0^{-1}  
$$  
  
$$F=U\Sigma V^T=  
\left[  
	\begin{matrix}  
	u_0& u_1 & e_1  
	\end{matrix}  
	\right]  
\left[  
	\begin{matrix}  
	\sigma_0 & & \\ & \sigma_1 & \\ & & 0  
		\end{matrix}  
	\right]  
	\left[  
	\begin{matrix}  
	v_0^T\\ v_1^T \\e_0^T  
	\end{matrix}  
	\right]$$  
  
	  
自标定求焦距  
  
  
$$  
\begin{gathered}  
\frac{u_1^T D_0 u_1}{\sigma_0^2 v_0^T D_1 v_0} = -\frac{u_0^T D_0 u_1}{\sigma_0 \sigma_1 v_0^T D_1 v_1} = \frac{u_0^T D_0 u_0}{\sigma_1^2 v_1^T D_1 v_1} \\ \\  
D_j = K_j K_j^T = \text{diag}(f_j^2, f_j^2, 1) =   
\begin{bmatrix}  
f_j^2 & 0 & 0 \\  
0 & f_j^2 & 0 \\  
0 & 0 & 1  
\end{bmatrix}\\ \\  
e_{ij0}(f_0^2) = u_i^T D_0 u_j = a_{ij} + b_{ij} f_0^2 \\  
e_{ij1}(f_1^2) = \sigma_i \sigma_j v_i^T D_1 v_j = c_{ij} + d_{ij} f_1^2 \\ \\  
  
\frac{a_{11} + b_{11} f_0^2}{c_{00} + d_{00} f_1^2 } = -\frac{a_{01} + b_{01} f_0^2}{c_{01} + d_{01} f_1^2 } = \frac{a_{00} + b_{00} f_0^2}{c_{11} + d_{11} f_1^2 }\\  
由此求解f_0 f_1  
  
\\ \\  
e_{ij0}(f_0^2) = \lambda e_{ij1}(f_1^2)\\ \\  
\end{gathered}  
$$  